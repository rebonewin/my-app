type StatCardProps = {
  title: string;
  value: number | string;
  color: string;
  icon: string;
};

export default function StatCard({
  title,
  value,
  color,
  icon,
}: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/30`}
    >
      <div className="flex items-center justify-between">

        <div>
          <h3 className="text-gray-400 text-sm">
            {title}
          </h3>

          <p className={`mt-3 text-4xl font-bold ${color}`}>
            {value}
          </p>
        </div>

        <div className="text-5xl">
          {icon}
        </div>

      </div>
    </div>
  );
}