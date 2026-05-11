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
    green: "border-emerald-200 bg-[#f2fbf7]",
    red: "border-red-200 bg-red-50",
    navy: "border-[#08233f] bg-[#08233f] text-white",
  };

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div
        className={`text-xs font-semibold uppercase ${
          tone === "navy" ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
      <div
        className={`mt-1.5 text-sm leading-5 ${
          tone === "navy" ? "text-white/75" : "text-slate-600"
        }`}
      >
        {detail}
      </div>
    </div>
  );
}
