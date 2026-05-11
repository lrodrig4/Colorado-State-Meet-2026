import type { VerificationStatus } from "@/types/domain";

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, string> = {
    verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
    manual_approved: "border-sky-200 bg-sky-50 text-sky-700",
    depth_only: "border-slate-200 bg-slate-50 text-slate-600",
    needs_review: "border-amber-200 bg-amber-50 text-amber-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${styles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
