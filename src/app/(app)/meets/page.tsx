import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { SimpleSteps } from "@/components/AppPrimitives";
import { PageHeader } from "@/components/PageHeader";
import { MeetsTable } from "@/components/MeetsTable";
import { meets } from "@/lib/data/meets";

export default function MeetsPage() {
  return (
    <div>
      <PageHeader
        title="Meet List"
        description="Find meet dates, result links, and which result source the app will use first."
        actions={
          <Link
            href="/meets/import"
            className="coach-action app-button-navy inline-flex h-10 items-center gap-2 px-4 text-sm"
          >
            <PlusCircle size={16} />
            Add results
          </Link>
        }
      />
      <SimpleSteps
        steps={[
          {
            title: "Find a meet",
            detail: "Search the table by name or date.",
          },
          {
            title: "Open results",
            detail: "Use the results link when it exists.",
          },
          {
            title: "Add missing results",
            detail: "Use Add results for pasted data.",
          },
        ]}
      />
      <MeetsTable meets={meets} />
    </div>
  );
}
