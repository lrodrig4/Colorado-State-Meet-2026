export function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "green" | "red" | "navy";
}) {
  const tones = {
    default: "border-slate-200 bg-white",
    green: "border-emerald-200 bg-emerald-50",
    red: "border-red-200 bg-red-50",
    navy: "border-[#16324f]/20 bg-[#16324f] text-white",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div
        className={`text-xs font-semibold uppercase ${
          tone === "navy" ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-normal">{value}</div>
      <div
        className={`mt-2 text-sm ${
          tone === "navy" ? "text-white/75" : "text-slate-600"
        }`}
      >
        {detail}
      </div>
    </div>
  );
}
