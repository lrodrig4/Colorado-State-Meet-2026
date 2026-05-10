import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MeetsTable } from "@/components/MeetsTable";
import { meets } from "@/lib/data/meets";

export default function MeetsPage() {
  return (
    <div>
      <PageHeader
        title="Meets"
        description="Calendar-driven meet inventory with discovered source ranking. Official timing links take priority over Athletic.net, MileSplit, and MaxPreps."
        actions={
          <Link
            href="/meets/import"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#16324f] px-4 text-sm font-semibold text-white"
          >
            <PlusCircle size={16} />
            Add meet or results
          </Link>
        }
      />
      <MeetsTable meets={meets} />
    </div>
  );
}
