type StatusCardProps = {
  title: string;
  value: string;
  description?: string;
  tone?: "ok" | "error";
};

export function StatusCard({
  title,
  value,
  description,
  tone = "ok",
}: StatusCardProps) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-2xl font-semibold capitalize">{value}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
    </div>
  );
}
