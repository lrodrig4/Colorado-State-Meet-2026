import { cookies } from "next/headers";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { PageHeader } from "@/components/PageHeader";
import { VirtualMeetView } from "@/components/VirtualMeetView";
import {
  getSchoolOptionsForClassification,
  getVirtualMeetForClassification,
} from "@/lib/services/appData";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  resolveFocusTeam,
} from "@/lib/utils/focusTeam";
import { resolveClassification } from "@/lib/utils/classificationScope";

export default async function VirtualStateMeetPage({
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
  const schoolOptions = getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const meet = getVirtualMeetForClassification(classification);

  return (
    <div>
      <PageHeader
        title="State scoring scenarios"
        description={`Run one CHSAA ${classification} boys or girls state scoreboard at a time, then edit finishes and score ranges for ${focusTeam}.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label={`${classification} team`}
            />
          </>
        }
      />
      <VirtualMeetView meet={meet} focusTeam={focusTeam} />
    </div>
  );
}
