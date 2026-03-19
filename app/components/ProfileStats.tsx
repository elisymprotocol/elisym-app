import type { StoredJob } from "@elisym/sdk";

interface ProfileStatsProps {
  jobs: StoredJob[];
}

export function ProfileStats({ jobs }: ProfileStatsProps) {
  const ordered = jobs.length;
  const fulfilled = jobs.filter((j) => j.status === "completed").length;
  let spent = 0;
  for (const j of jobs) {
    if (j.paymentAmount) {
      spent += j.paymentAmount;
    }
  }
  const spentSol = (spent / 1_000_000_000).toFixed(2);

  const stats = [
    { value: String(ordered), label: "Ordered" },
    { value: String(fulfilled), label: "Fulfilled" },
    { value: `${spentSol} SOL`, label: "Spent" },
    { value: "0.00 SOL", label: "Earned" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 max-sm:grid-cols-1">
      {stats.map((s) => (
        <div
          key={s.label}
          className="text-center py-5 bg-surface-2 rounded-xl"
        >
          <div className="text-2xl font-bold mb-1">{s.value}</div>
          <div className="text-[12.5px] text-text-2">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
