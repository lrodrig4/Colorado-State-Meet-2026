export type IntelPost = {
  slug: string;
  title: string;
  deck: string;
  lane: string;
  publishedAt: string;
  readTime: string;
  audience: string;
  author: string;
  sourceTrail: string[];
  relatedHref: string;
  relatedLabel: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

export const intelPosts: IntelPost[] = [
  {
    slug: "5a-boys-state-bubble",
    title: "5A Boys State Bubble",
    deck:
      "The late-season read on the marks around the Final 18 line and the events most likely to swing after scratches.",
    lane: "Bubble board",
    publishedAt: "2026-05-10",
    readTime: "4 min",
    audience: "5A boys coaches",
    author: "Colorado Distance Intel",
    sourceTrail: [
      "MileSplit public result rows",
      "MaxPreps state rankings",
      "Current Final 18 command center",
    ],
    relatedHref: "/rankings?class=5A",
    relatedLabel: "Open 5A rankings",
    sections: [
      {
        heading: "What changed this week",
        body:
          "Late verified marks moved the bubble more than the headline list shows. The useful question is not just who ranks top 18, but who still has a plausible scratch, relay conflict, or last-chance mark path.",
      },
      {
        heading: "What coaches should check",
        body:
          "Start with the athletes already projected to score, then work outward to the first event where one place changes the team race. That is the event worth scouting before anything else.",
      },
      {
        heading: "Why this is not MileSplit",
        body:
          "A raw state list tells you the order. A coach notebook tells you where the order can still break, and which decision gives your team the highest leverage.",
      },
    ],
  },
  {
    slug: "4a-girls-team-watch",
    title: "4A Girls Team Watch",
    deck:
      "The programs with enough scoring paths to matter, plus the single-event swings that can change the podium math.",
    lane: "Team race",
    publishedAt: "2026-05-09",
    readTime: "3 min",
    audience: "4A coaches and athletes",
    author: "Colorado Distance Intel",
    sourceTrail: [
      "MaxPreps 4A rankings",
      "Virtual state scoring model",
      "Verified public meet results",
    ],
    relatedHref: "/virtual-state-meet?class=4A",
    relatedLabel: "Open 4A scenarios",
    sections: [
      {
        heading: "The watchlist",
        body:
          "The team race is not just the leader board. It is the mix of safe points, bubble points, and one athlete who can move from a qualifier to a scorer.",
      },
      {
        heading: "The signal",
        body:
          "A useful team watch highlights verified source quality, teammate conflicts, and event overlap. Those are the details that separate a ranking from a usable scouting report.",
      },
      {
        heading: "The next upgrade",
        body:
          "As the XC version grows, the same idea becomes a regional qualifying watchlist with course strength, pack compression, and state field movement.",
      },
    ],
  },
  {
    slug: "3a-last-qualifier-movement",
    title: "3A Last Qualifier Movement",
    deck:
      "A plain-language report on the final qualifying spots, late meets, and which marks should make coaches nervous.",
    lane: "Last qualifier",
    publishedAt: "2026-05-08",
    readTime: "5 min",
    audience: "3A coaches",
    author: "Colorado Distance Intel",
    sourceTrail: [
      "MileSplit last-chance imports",
      "CHSAA classification checks",
      "Final qualifier movement model",
    ],
    relatedHref: "/rankings?class=3A",
    relatedLabel: "Open 3A rankings",
    sections: [
      {
        heading: "The movement",
        body:
          "The final qualifying spots are volatile because one verified result can move multiple schools at once. That is where coaches need context before they assume the list is settled.",
      },
      {
        heading: "The format",
        body:
          "The public version stays short and readable: who moved in, who got pushed out, and which event has the most fragile cutline.",
      },
      {
        heading: "The business role",
        body:
          "This is the top of the funnel. A coach reads the public movement report, then opens the private command center to test their own team.",
      },
    ],
  },
  {
    slug: "runtism-report",
    title: "Runtism Report",
    deck:
      "The shareable voice layer: distance takes, race culture, team stories, and charts runners actually send around.",
    lane: "Column",
    publishedAt: "2026-05-07",
    readTime: "5 min",
    audience: "Distance runners",
    author: "Marshall desk",
    sourceTrail: [
      "Public rankings",
      "Coach-submitted race notes",
      "Colorado distance watchlist",
    ],
    relatedHref: "/intel",
    relatedLabel: "Open intel feed",
    sections: [
      {
        heading: "The voice",
        body:
          "The math gets coaches to trust the product. The voice gets runners to open it. A sharp weekly column gives the site a reason to exist between result drops.",
      },
      {
        heading: "The format",
        body:
          "Keep it short, specific, and locally fluent: one team trend, one athlete stock-up, one race that deserves attention, and one chart that makes the point instantly.",
      },
      {
        heading: "The business role",
        body:
          "Personality is not decoration. It is distribution. The column should point readers back to the rankings, previews, and coach tools every week.",
      },
    ],
  },
  {
    slug: "coach-pro-founder-offer",
    title: "Coach Pro Founder Offer",
    deck:
      "A narrow paid promise for early coaches: be better prepared for the next important race.",
    lane: "Subscription",
    publishedAt: "2026-05-06",
    readTime: "4 min",
    audience: "Program directors",
    author: "Colorado Distance Intel",
    sourceTrail: [
      "Current command center workflows",
      "Coach founder-access interviews",
      "State-week scouting use cases",
    ],
    relatedHref: "/coach-pro",
    relatedLabel: "Request Coach Pro access",
    sections: [
      {
        heading: "The offer",
        body:
          "Founder coaches should get a saved team dashboard, weekly scouting notes, scenario tools, and direct input into what gets built next.",
      },
      {
        heading: "The proof",
        body:
          "The current command center already shows the proof: rankings, scoring, graphics, and weekend decisions built from public data but packaged for coach action.",
      },
      {
        heading: "The line",
        body:
          "Do not sell a giant platform yet. Sell one useful outcome: a coach opens the product and knows what to do before the next meet.",
      },
    ],
  },
];

export function featuredIntelPosts(limit = 3) {
  return intelPosts.slice(0, limit);
}

export function getIntelPostBySlug(slug: string) {
  return intelPosts.find((post) => post.slug === slug);
}
