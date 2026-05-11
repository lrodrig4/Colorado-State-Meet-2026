/* eslint-disable @next/next/no-img-element */
import type { Classification } from "@/types/domain";
import type { SchoolBrandAsset } from "@/types/schoolBranding";

function initialsForTeam(teamName: string) {
  const coreName = teamName
    .replace(/\bhigh school\b/gi, "")
    .replace(/\bschool\b/gi, "")
    .replace(/\bthe\b/gi, "")
    .trim();
  const initials = coreName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || teamName.slice(0, 2).toUpperCase();
}

export function TeamMascotMark({
  schoolName,
  classification,
  asset,
}: {
  schoolName: string;
  classification: Classification;
  asset?: SchoolBrandAsset;
}) {
  const approvedImage =
    asset?.licenseStatus === "approved" && asset.mascotPublicUrl
      ? asset.mascotPublicUrl
      : undefined;
  const dominantColor = asset?.dominantColor ?? "#102b47";
  const accentColor = asset?.accentColor ?? "#d3a32a";

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white p-1.5 shadow-sm ring-1 ring-[#d8e2ea] sm:h-20 sm:w-20">
        {approvedImage ? (
          <img
            src={approvedImage}
            alt={`${schoolName} mascot`}
            className="h-full w-full object-contain"
            loading="eager"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-md text-xl font-semibold text-white sm:text-2xl"
            style={{
              background: `linear-gradient(145deg, ${dominantColor}, #24466c)`,
              boxShadow: `inset 0 0 0 2px ${accentColor}`,
            }}
          >
            {initialsForTeam(schoolName)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-normal text-[#557086]">
          Selected team
        </div>
        <div className="mt-1 break-words text-[1.15rem] font-semibold leading-tight text-slate-950 sm:text-2xl">
          {schoolName}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#16324f] ring-1 ring-[#d8e2ea]">
            CHSAA {classification}
          </span>
          {asset?.mascotName ? (
            <span className="rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-[#d8e2ea]">
              {asset.mascotName}
            </span>
          ) : null}
          <span className="rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-[#d8e2ea]">
            {approvedImage ? "Mascot PNG" : "PNG pending"}
          </span>
        </div>
      </div>
    </div>
  );
}
