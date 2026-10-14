type Props = {
  title: string;
  value: string | number;
  color?: string;
};

export default function InfoCard({
  title,
  value,
  color = "text-white",
}: Props) {
  return (
    <div className="rounded-xl bg-slate-800 p-5">

      <p className="text-gray-400">
        {title}
      </p>

      <p className={`mt-3 break-all text-lg font-bold ${color}`}>
        {value}
      </p>

    </div>
  );
}