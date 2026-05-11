import { cookies } from "next/headers";
import { SimpleSteps } from "@/components/AppPrimitives";
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
  const [schoolOptions, meet] = await Promise.all([
    getSchoolOptionsForClassification(classification),
    getVirtualMeetForClassification(classification),
  ]);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );

  return (
    <div>
      <PageHeader
        title="Change Scores"
        description={`Pick boys or girls, change finish places, and see how ${focusTeam}'s team score changes.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label="Team"
            />
          </>
        }
      />
      <SimpleSteps
        steps={[
          {
            title: "Pick boys or girls",
            detail: "Use the first two buttons.",
          },
          {
            title: "Open a team",
            detail: "Tap edit places on any team row.",
          },
          {
            title: "Change places",
            detail: "The points update right away.",
          },
        ]}
      />
      <VirtualMeetView meet={meet} focusTeam={focusTeam} />
    </div>
  );
}
